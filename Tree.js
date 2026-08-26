// =========================================================
// algorithms/Tree.js
//
// CAPSTONE DSA NOTE — TREE
// Used for: organizing job categories in a hierarchy
// (e.g. Technology -> Software Development -> Backend Developer).
// Traversed recursively (depth-first) to flatten into a list
// for the "Browse Categories" UI, or to find a node by name.
// =========================================================

class TreeNode {
    constructor(name, meta = {}) {
        this.name = name;
        this.meta = meta;
        this.children = [];
    }

    addChild(childNode) {
        this.children.push(childNode);
        return childNode;
    }
}

class Tree {
    constructor(rootName = 'Root') {
        this.root = new TreeNode(rootName);
    }

    // Depth-first traversal, returns flat array of nodes with depth info
    traverse(node = this.root, depth = 0, results = []) {
        results.push({ name: node.name, depth, meta: node.meta });
        for (const child of node.children) {
            this.traverse(child, depth + 1, results);
        }
        return results;
    }

    // Depth-first search for a node by name
    findNode(name, node = this.root) {
        if (node.name === name) return node;
        for (const child of node.children) {
            const found = this.findNode(name, child);
            if (found) return found;
        }
        return null;
    }
}

module.exports = { Tree, TreeNode };
