#!/usr/bin/env python3
"""Run the game (or any page) in a real WebKit: WebKitGTK, the same engine family as Safari (JavaScriptCore, WebCore, Web Audio, WebGL through
ANGLE), under a virtual display. Every second it prints the web process's memory (RSS), what the game says about itself (`window.__pool`, so
the address needs ?debug) and, with --audio, how many Web Audio nodes the page has made and let go of. It ends when the web process dies (and
says why) or the time is up. Exit code 0: the page was still alive; 3: the web process ended; 2: bad usage.

What it can and cannot tell. It runs the same JavaScript engine and the same page code as an iPad's Safari, so a crash in the game's script, the
DOM, the log or Web Audio shows here. It has none of the iPad's graphics (Metal, the GPU process) and none of iOS's memory limits (jetsam), so
a page that survives here says nothing about those. The picture is drawn by software (slow: a few frames a second), so give a long run, or add
`norender` to the address to update the scene without drawing it (real time, all the game's script running).

One-off setup (Ubuntu 24.04; Python 3.12 is the one the GI bindings are built for):
    apt-get install -y --no-install-recommends xvfb xauth libwebkit2gtk-4.1-0 gir1.2-webkit2-4.1 python3-gi gir1.2-gtk-3.0 \\
        libgl1-mesa-dri libegl1 libgles2 fonts-dejavu-core gstreamer1.0-plugins-base gstreamer1.0-plugins-good
    # only for --audio: a sound server with a silent sink, so the page's AudioContext really runs
    apt-get install -y --no-install-recommends pulseaudio pulseaudio-utils gstreamer1.0-pulseaudio
    pulseaudio --system --daemonize=yes --disallow-exit --exit-idle-time=-1 -n \\
        -L "module-native-protocol-unix auth-anonymous=1 socket=/tmp/pa.sock" -L "module-null-sink sink_name=null"
    export PULSE_SERVER=unix:/tmp/pa.sock

Run (serve dist/ first, e.g. `python3 -m http.server 8767 --directory dist`):
    LIBGL_ALWAYS_SOFTWARE=1 xvfb-run -a -s "-screen 0 1280x800x24" /usr/bin/python3.12 tools/webkit-run.py \\
        "http://localhost:8767/?trial=shift&nostory&debug&norender" 100 --size 640x400 --audio

Without --audio the page's AudioContext stays "interrupted" (it needs a tap, as in Safari) and no sound is made, which is also what an iPad
does in a hunt nobody touches. Pass --js 'expression' to print something else each second."""
import glob
import sys
import time

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

# Counts the Web Audio nodes a page makes and lets go of (window.__ac), and keeps its contexts where --js can read them.
COUNT_AUDIO = """
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ac = (window.__ac = { ctxs: [], oscillators: 0, sources: 0, ended: 0 });
  const make = function (...a) { const c = new AC(...a); ac.ctxs.push(c); return c; };
  make.prototype = AC.prototype;
  window.AudioContext = make;
  if (window.webkitAudioContext) window.webkitAudioContext = make;
  const wrap = (name, key) => {
    const orig = AC.prototype[name];
    AC.prototype[name] = function (...a) {
      ac[key]++;
      const n = orig.apply(this, a);
      n.addEventListener("ended", () => ac.ended++);
      return n;
    };
  };
  wrap("createOscillator", "oscillators");
  wrap("createBufferSource", "sources");
})();
"""
STATE = (
    "JSON.stringify({mode: window.__pool && window.__pool.mode,"
    " shift: window.__pool && window.__pool.sim && +window.__pool.sim.time.toFixed(1),"
    " audio: window.__ac && {state: window.__ac.ctxs[0] && window.__ac.ctxs[0].state,"
    " time: window.__ac.ctxs[0] && +window.__ac.ctxs[0].currentTime.toFixed(1),"
    " oscillators: window.__ac.oscillators, sources: window.__ac.sources, ended: window.__ac.ended},"
    " dom: document.getElementsByTagName('*').length})"
)


def usage():
    print(__doc__.split("\n\n")[0] + "\n\nusage: webkit-run.py URL [SECONDS] [--size WxH] [--audio] [--js EXPRESSION]")
    sys.exit(2)


def main(argv):
    if not argv or argv[0].startswith("--"):
        usage()
    url = argv[0]
    limit = float(argv[1]) if len(argv) > 1 and not argv[1].startswith("--") else 90.0
    size = argv[argv.index("--size") + 1] if "--size" in argv else "900x600"
    js = argv[argv.index("--js") + 1] if "--js" in argv else STATE
    audio = "--audio" in argv
    width, height = (int(n) for n in size.split("x"))

    window = Gtk.Window()
    window.set_default_size(width, height)
    settings = WebKit2.Settings()
    settings.set_enable_webgl(True)
    settings.set_enable_webaudio(True)
    # Safari starts an AudioContext only after a tap; to hear the page's sounds here, allow autoplay.
    settings.set_media_playback_requires_user_gesture(not audio)
    content = WebKit2.UserContentManager()
    if audio:
        content.add_script(
            WebKit2.UserScript(
                COUNT_AUDIO,
                WebKit2.UserContentInjectedFrames.ALL_FRAMES,
                WebKit2.UserScriptInjectionTime.START,
                None,
                None,
            )
        )
    kwargs = {"user_content_manager": content}
    if audio:
        kwargs["website_policies"] = WebKit2.WebsitePolicies(autoplay=WebKit2.AutoplayPolicy.ALLOW)
    view = WebKit2.WebView(web_context=WebKit2.WebContext.new_ephemeral(), **kwargs)
    view.set_settings(settings)
    window.add(view)
    window.show_all()

    began = time.time()
    state = {"ended": None, "last": ""}

    def processes():
        found = []
        for path in glob.glob("/proc/[0-9]*"):
            try:
                command = open(path + "/cmdline", "rb").read().replace(b"\0", b" ").decode(errors="ignore")
            except OSError:
                continue
            if "WebKitWebProcess" in command or "WebKitGPUProcess" in command:
                found.append((int(path.rsplit("/", 1)[1]), "gpu" if "GPUProcess" in command else "web"))
        return found

    def rss_mb(pid):
        try:
            for line in open("/proc/%d/status" % pid):
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024
        except OSError:
            pass
        return -1

    def done(why):
        if state["ended"] is None:
            state["ended"] = why
            print("%6.1fs  END %s" % (time.time() - began, why), flush=True)
            GLib.idle_add(Gtk.main_quit)

    view.connect("web-process-terminated", lambda _view, reason: done("web process terminated: %s" % reason))
    view.connect("load-failed", lambda _view, _event, uri, error: print("load failed", uri, error.message, flush=True) or False)

    def got(_view, result, _data):
        try:
            value = _view.evaluate_javascript_finish(result)
            state["last"] = value.to_string() if value is not None else ""
        except Exception as error:  # the page may be mid-navigation or gone
            state["last"] = "js: %s" % str(error)[:80]

    def tick():
        elapsed = time.time() - began
        memory = " ".join("%s %d MB" % (kind, rss_mb(pid)) for pid, kind in processes())
        print("%6.1fs  %s | %s" % (elapsed, state["last"], memory), flush=True)
        view.evaluate_javascript(js, -1, None, None, None, got, None)
        if elapsed > limit:
            done("time is up (%d s), the page was still alive" % limit)
            return False
        return state["ended"] is None

    GLib.timeout_add(1000, tick)
    view.load_uri(url)
    Gtk.main()
    return 0 if state["ended"] and "time is up" in state["ended"] else 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
