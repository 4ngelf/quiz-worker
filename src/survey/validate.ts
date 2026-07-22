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

export const isArray = (value: any): value is any[] => {
    return Array.isArray(value);
};

export const isArrayWith = (value: any, predicate: (item: any) => boolean): value is any[] => {
    if (!Array.isArray(value)) {
        return false;
    }
    for (const item of value) {
        if (!predicate(item)) {
            return false;
        }
    }
    return true;
};

export const isObject = (value: any): value is object => {
    return typeof value === "object";
};

export const hasAttribute = (obj: Object, attribute: string): boolean => {
    return obj.hasOwnProperty(attribute);
};

export const hasAttributes = (obj: Object, attributes: string[]): boolean => {
    for (const attribute of attributes) {
        if (!obj.hasOwnProperty(attribute)) {
            return false;
        }
    }
    return true;
};