type StringRecord = Record<string, string>;

export const flatten = (params: StringRecord) => {
  if (!params) return '';
  const keys = Object.keys(params);
  return (keys || []).reduce((acc, cur, index) => {
    if (index) return `${acc}&${cur}=${String(params[cur])}`;
    return `${cur}=${String(params[cur])}`;
  }, '');
};

export const setSearchParams = (url: string, params: StringRecord) => {
  if (/\?/.test(url)) {
    return `${url}&${flatten(params)}`;
  }

  return `${url}?${flatten(params)}`;
};
