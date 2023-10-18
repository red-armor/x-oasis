// https://stackoverflow.com/questions/47135661/how-can-i-get-a-key-in-a-javascript-map-by-its-value

export default function getMapKeyByValue(map, searchValue) {
  for (const [key, value] of map.entries()) {
    if (value === searchValue) return key;
  }
}
