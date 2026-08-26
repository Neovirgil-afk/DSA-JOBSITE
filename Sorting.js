// =========================================================
// algorithms/Sorting.js
//
// CAPSTONE DSA NOTE — SORTING ALGORITHM (Merge Sort)
// Used for: sorting search results and job listings by a
// comparable field (e.g. title alphabetically, or salary).
// Implemented manually (not Array.prototype.sort) — O(n log n).
// =========================================================

function mergeSort(arr, compareFn) {
    if (arr.length <= 1) return arr;

    const mid = Math.floor(arr.length / 2);
    const left = mergeSort(arr.slice(0, mid), compareFn);
    const right = mergeSort(arr.slice(mid), compareFn);

    return merge(left, right, compareFn);
}

function merge(left, right, compareFn) {
    const result = [];
    let i = 0, j = 0;

    while (i < left.length && j < right.length) {
        if (compareFn(left[i], right[j]) <= 0) {
            result.push(left[i++]);
        } else {
            result.push(right[j++]);
        }
    }
    while (i < left.length) result.push(left[i++]);
    while (j < right.length) result.push(right[j++]);

    return result;
}

module.exports = { mergeSort };
