'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ElectronUtilityProcessChannel =
  exports.ElectronMessagePortMainChannel =
  exports.IPCRendererChannel =
  exports.IPCMainChannel =
    void 0;
// Channels
var IPCMainChannel_1 = require('./IPCMainChannel');
Object.defineProperty(exports, 'IPCMainChannel', {
  enumerable: true,
  get() {
    return __importDefault(IPCMainChannel_1).default;
  },
});
var IPCRendererChannel_1 = require('./IPCRendererChannel');
Object.defineProperty(exports, 'IPCRendererChannel', {
  enumerable: true,
  get() {
    return __importDefault(IPCRendererChannel_1).default;
  },
});
var ElectronMessagePortMainChannel_1 = require('./ElectronMessagePortMainChannel');
Object.defineProperty(exports, 'ElectronMessagePortMainChannel', {
  enumerable: true,
  get() {
    return __importDefault(ElectronMessagePortMainChannel_1).default;
  },
});
var ElectronUtilityProcessChannel_1 = require('./ElectronUtilityProcessChannel');
Object.defineProperty(exports, 'ElectronUtilityProcessChannel', {
  enumerable: true,
  get() {
    return __importDefault(ElectronUtilityProcessChannel_1).default;
  },
});
