

class HashTable {
    constructor(size = 128) {
        this.size = size;
        this.buckets = new Array(size).fill(null).map(() => []);
        this.count = 0;
    }

    // djb2-style string hash
    _hash(key) {
        const str = String(key).toLowerCase();
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 33 + str.charCodeAt(i)) >>> 0;
        }
        return hash % this.size;
    }

    set(key, value) {
        const index = this._hash(key);
        const bucket = this.buckets[index];
        const existing = bucket.find((entry) => entry.key === key);
        if (existing) {
            existing.value = value;
        } else {
            bucket.push({ key, value });
            this.count++;
        }
        return this;
    }

    get(key) {
        const index = this._hash(key);
        const bucket = this.buckets[index];
        const entry = bucket.find((e) => e.key === key);
        return entry ? entry.value : undefined;
    }

    has(key) {
        const index = this._hash(key);
        return this.buckets[index].some((e) => e.key === key);
    }

    addToList(key, value) {
        const index = this._hash(key);
        const bucket = this.buckets[index];
        const entry = bucket.find((e) => e.key === key);
        if (entry) {
            if (!entry.value.includes(value)) entry.value.push(value);
        } else {
            bucket.push({ key, value: [value] });
            this.count++;
        }
    }

    keys() {
        const result = [];
        for (const bucket of this.buckets) {
            for (const entry of bucket) result.push(entry.key);
        }
        return result;
    }

    entries() {
        const result = [];
        for (const bucket of this.buckets) {
            for (const entry of bucket) result.push([entry.key, entry.value]);
        }
        return result;
    }
}

module.exports = HashTable;
