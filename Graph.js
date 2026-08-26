

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

        const visited = new Set([start]);
        const queue = [[start]];

        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];

            for (const neighbor of this.getNeighbors(node)) {
                if (visited.has(neighbor)) continue;
                const newPath = [...path, neighbor];
                if (neighbor === target) return newPath;
                visited.add(neighbor);
                queue.push(newPath);
            }
        }
        return null;
    }
}

module.exports = Graph;
