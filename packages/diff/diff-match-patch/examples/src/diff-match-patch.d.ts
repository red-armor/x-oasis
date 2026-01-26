declare module 'diff-match-patch' {
  export class diff_match_patch {
    diff_main(
      text1: string,
      text2: string,
      checkLines?: boolean
    ): Array<[number, string]>;
    diff_cleanupSemantic(diffs: Array<[number, string]>): void;
    diff_linesToChars(text1: string, text2: string): [string, string, string[]];
    diff_charsToLines(
      diffs: Array<[number, string]>,
      lineArray: string[]
    ): void;
  }
}
