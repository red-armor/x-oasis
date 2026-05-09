const isProxySupported = (): boolean => {
  try {
    return typeof Proxy === 'function';
  } catch {
    return false;
  }
};

export default isProxySupported;
