// =========================================================
// algorithms/MaxHeap.js
//
// CAPSTONE DSA NOTE — MAX HEAP / PRIORITY QUEUE
// Used for: ranking jobs by match percentage. The job with the
// highest match score always has the highest priority and is
// extracted first via extractMax(), giving O(log n) insert/extract
// instead of a plain sort() call.
//
// Each heap node is { priority, data }. Higher priority = higher rank.
// =========================================================

class MaxHeap {
    constructor() {
        this.heap = [];
    }

    size() {
        return this.heap.length;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i) { return 2 * i + 1; }
    _right(i) { return 2 * i + 2; }

    _swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    insert(priority, data) {
        this.heap.push({ priority, data });
        this._bubbleUp(this.heap.length - 1);
    }

    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = this._parent(index);
            if (this.heap[parentIndex].priority < this.heap[index].priority) {
                this._swap(parentIndex, index);
                index = parentIndex;
            } else break;
        }
    }

    extractMax() {
        if (this.isEmpty()) return null;
        const max = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._bubbleDown(0);
        }
        return max;
    }

    _bubbleDown(index) {
        const n = this.heap.length;
        while (true) {
            const left = this._left(index);
            const right = this._right(index);
            let largest = index;

            if (left < n && this.heap[left].priority > this.heap[largest].priority) largest = left;
            if (right < n && this.heap[right].priority > this.heap[largest].priority) largest = right;

            if (largest === index) break;
            this._swap(index, largest);
            index = largest;
        }
    }

    // Drains the heap and returns items ranked highest -> lowest.
    // This is the actual DSA-driven ranking used by JobMatchingService.
    toSortedArray() {
        const clone = new MaxHeap();
        clone.heap = this.heap.map((n) => ({ ...n }));
        const result = [];
        let node;
        while ((node = clone.extractMax()) !== null) {
            result.push(node.data);
        }
        return result;
    }
}

module.exports = MaxHeap;
