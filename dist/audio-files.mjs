// Recorded sounds that replace the procedural stand-ins, one list per sound. Leave a list empty and the game
// synthesises a placeholder; put files under dist/assets/audio/ and list them here to use them instead (each play picks
// one at random). Paths are relative to this file. mp3, ogg and wav all work.
//
//   karen: Karen's complaining (a squawk every one to two seconds while she is loud: "Excuse me?!", "This is
//          unacceptable!", sighs, tutting). Short clips, 0.4 to 1.5 seconds each, work best.
export const AUDIO_FILES = {
  karen: [
    // "./assets/audio/karen-complain-1.mp3",
    // "./assets/audio/karen-complain-2.mp3",
  ],
};
