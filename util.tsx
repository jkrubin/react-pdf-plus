export function filterMapByKeyRange<K, V>(map: Map<K, V>, min: number, max: number): void {
    for (let key of map.keys()) {
      if (typeof key !== 'number' || key < min || key > max) {
        map.delete(key);
      }
    }
  }