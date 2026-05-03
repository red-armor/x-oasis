# @x-oasis/ansi-colors

picocolors-style ANSI terminal color formatters with a runtime on/off switch.

## Installation

```bash
$ npm i @x-oasis/ansi-colors
```

## How to use

```typescript
import { colors, getUseColor, setUserColor } from '@x-oasis/ansi-colors'

console.log(colors.green('hello'))

setUserColor(false) // strip colors at runtime
```

## How to run test

```bash
$ pnpm test
```
