

class Graph {
    constructor() {
        this.adjacencyList = new Map(); // node -> Set(neighbor nodes)
    }

    addNode(node) {
        if (!this.adjacencyList.has(node)) {
            this.adjacencyList.set(node, new Set());
        }
    }

    addEdge(from, to) {
        this.addNode(from);
        this.addNode(to);
        this.adjacencyList.get(from).add(to);
    }

    getNeighbors(node) {
        return Array.from(this.adjacencyList.get(node) || []);
    }

    bfsPath(start, target) {
        if (!this.adjacencyList.has(start) || !this.adjacencyList.has(target)) return null;
        if (start === target) return [start];

        // Store each node's predecessor instead of copying the full path
        // into every queue entry. This keeps BFS at O(V + E).
        const visited = new Set([start]);
        const previous = new Map();
        const queue = [start];
        let head = 0;

        while (head < queue.length) {
            const node = queue[head++];

            for (const neighbor of this.getNeighbors(node)) {
                if (visited.has(neighbor)) continue;

                visited.add(neighbor);
                previous.set(neighbor, node);

                if (neighbor === target) {
                    const path = [target];
                    let current = target;

                    while (current !== start) {
                        current = previous.get(current);
                        if (current === undefined) return null;
                        path.push(current);
                    }

                    return path.reverse();
                }

                queue.push(neighbor);
            }
        }

        return null;
    }
}

module.exports = Graph;
