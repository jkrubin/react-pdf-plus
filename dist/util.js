export function filterMapByKeyRange(map, min, max) {
    for (let key of map.keys()) {
        if (typeof key !== 'number' || key < min || key > max) {
            map.delete(key);
        }
    }
}
