export const extractTokenTargetIndex = (val) => val.map((v) => v.targetIndex);
export const extractTokenMetaIndex = (val) =>
  val.map((v) => (v.meta?.index != null ? v.meta?.index : v.meta));
