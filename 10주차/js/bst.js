class BSTNode {
    constructor(value) {
        this.value = value;
        this.left = null;
        this.right = null;
        this.bounds = { min: 0, max: 100 }; // For number line visualization
    }
}

class BST {
    constructor() {
        this.root = null;
        this.visitedNodes = []; // For visualization
    }

    insert(value) {
        if (!this.root) {
            this.root = new BSTNode(value);
            this.root.bounds = { min: 0, max: 100 }; // Global bounds
            return;
        }

        let current = this.root;
        while (true) {
            if (value < current.value) {
                if (!current.left) {
                    current.left = new BSTNode(value);
                    current.left.bounds = { min: current.bounds.min, max: current.value };
                    break;
                }
                current = current.left;
            } else if (value > current.value) {
                if (!current.right) {
                    current.right = new BSTNode(value);
                    current.right.bounds = { min: current.value, max: current.bounds.max };
                    break;
                }
                current = current.right;
            } else {
                // Ignore duplicates
                break;
            }
        }
    }

    search(query) {
        this.visitedNodes = [];
        let current = this.root;
        let found = false;

        while (current) {
            this.visitedNodes.push(current);
            if (query === current.value) {
                found = true;
                break;
            } else if (query < current.value) {
                current = current.left;
            } else {
                current = current.right;
            }
        }

        // 방문한 노드 중 쿼리와 가장 가까운 노드를 bestNode로 선택
        let bestNode = null;
        let bestDist = Infinity;
        for (const node of this.visitedNodes) {
            const dist = Math.abs(node.value - query);
            if (dist < bestDist) {
                bestDist = dist;
                bestNode = node;
            }
        }

        return {
            found: found,
            visitedNodes: this.visitedNodes,
            bestNode: bestNode
        };
    }
}
