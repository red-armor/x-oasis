{
    "operations": {
        "originalRange": {
            "start": 244,
            "end": 315
        },
        "finalRange": {
            "start": 244,
            "end": 312
        },
        "originalFragment": "<h1 class=\"text-[--color-text-title] text-2xl font-bold\">姓名3333444</h1>",
        "finalFragment": "<h1 class=\"text-2xl font-bold text-[rgba(193,30,30,0.85)]\">姓名33</h1>",
        "changeAnalysis": {
            "originalFragment": "<h1 class=\"text-[--color-text-title] text-2xl font-bold\">姓名3333444</h1>",
            "finalFragment": "<h1 class=\"text-2xl font-bold text-[rgba(193,30,30,0.85)]\">姓名33</h1>",
            "equal": false,
            "onlyDeletion": false,
            "onlyInsertion": false,
            "replacement": true,
            "summary": "替换: [--color-text-title] text-2xl font-bold3… → 2xl font-bold text-[rgba(193,30,30,0.85)…",
            "diffs": [
                [
                    0,
                    "<h1 class=\"text-"
                ],
                [
                    -1,
                    "[--color-text-title] text-2xl font-bold"
                ],
                [
                    1,
                    "2xl font-bold text-[rgba(193,30,30,0.85)]"
                ],
                [
                    0,
                    "\">姓名33"
                ],
                [
                    -1,
                    "33444"
                ],
                [
                    0,
                    "</h1>"
                ]
            ]
        }
    },
    "htmlDiff": {
        "original": {
            "tagName": "h1",
            "classList": [
                "text-[--color-text-title]",
                "text-2xl",
                "font-bold"
            ],
            "textContent": "姓名3333444",
            "otherAttrs": {}
        },
        "final": {
            "tagName": "h1",
            "classList": [
                "text-2xl",
                "font-bold",
                "text-[rgba(193,30,30,0.85)]"
            ],
            "textContent": "姓名33",
            "otherAttrs": {}
        },
        "classAdded": [
            "text-[rgba(193,30,30,0.85)]"
        ],
        "classRemoved": [
            "text-[--color-text-title]"
        ],
        "textOriginal": "姓名3333444",
        "textFinal": "姓名33",
        "textChanged": true,
        "textSummary": "「姓名3333444」 → 「姓名33」"
    }
}