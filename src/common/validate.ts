// Validation Functions

export const isString = (value: any): value is string => {
  return typeof value === "string";
};

export const isNumber = (value: any): value is number => {
  return typeof value === "number";
};

export const isBoolean = (value: any): value is boolean => {
  return typeof value === "boolean";
};

export const isArray = <T>(value: any): value is T[] => {
  return Array.isArray(value);
};

export const isArrayWith = <T>(value: any, predicate: (item: any) => item is T): value is T[] => {
  return Array.isArray(value) && value.every(predicate);
};

export const isObject = (value: any): value is object => {
  return typeof value === "object";
};

export const hasAttributeAny = <const Attr extends string>(
  obj: object,
  attribute: Attr,
): obj is { [P in Attr]: any } => {
  return obj.hasOwnProperty(attribute);
};

export const hasAttribute = <const Attr extends string, AttrType>(
  obj: object,
  attribute: Attr,
  checker_fn: (value: any) => value is AttrType,
): obj is { [P in Attr]: AttrType } => {
  return hasAttributeAny(obj, attribute) && checker_fn(obj[attribute]);
};

export const hasAttributes = <const Attrs extends readonly string[]>(
  obj: object,
  attributes: Attrs,
): obj is { [P in Attrs[number]]: any } => {
  for (const attribute of attributes) {
    if (!obj.hasOwnProperty(attribute)) {
      return false;
    }
  }
  return true;
};
