/**
 * 将对象转换为查询字符串
 */
export const objToQueryStr = (obj: any) => {
  if (!obj) return '';

  let str = '?';
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      str += `${key}=${obj[key]}&`;
    }
  });
  str = str.substring(0, str.length - 1);
  return str;
};