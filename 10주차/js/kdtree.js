/**
 * KD Tree Node
 */
class KDNode {
    constructor(point, axis, left, right, bounds) {
        this.point = point;       // {x, y}
        this.axis = axis;         // 0 for x, 1 for y
        this.left = left;         // KDNode
        this.right = right;       // KDNode
        this.bounds = bounds;     // {minX, maxX, minY, maxY} for visualization
        this.buildOrder = -1;     // 구축 순서 (단계별 시각화용)
        this.depth = 0;           // 트리 깊이
    }
}

/**
 * KD Tree Implementation for 2D space
 */
class KDTree {
    constructor(points, width, height) {
        this._buildCounter = 0;   // 구축 순서 카운터
        this.buildSteps = [];     // 각 단계의 메타 정보 (단계별 시각화용)
        this.totalNodes = 0;      // 전체 노드 수
        this.root = this.buildTree(points, 0, 0, width, 0, height);
        this.totalNodes = this._buildCounter;
        this.visitedNodes = []; // For visualization
    }

    buildTree(points, depth, minX, maxX, minY, maxY) {
        if (points.length === 0) return null;

        const axis = depth % 2; // 0: x-axis, 1: y-axis

        // Sort points by the current axis
        points.sort((a, b) => {
            return axis === 0 ? a.x - b.x : a.y - b.y;
        });

        // Median index
        const medianIdx = Math.floor(points.length / 2);
        const medianPoint = points[medianIdx];

        // Bounds for visualization (representing the space this node splits)
        const bounds = { minX, maxX, minY, maxY };

        // Split left and right arrays
        const leftPoints = points.slice(0, medianIdx);
        const rightPoints = points.slice(medianIdx + 1);

        // 구축 순서 기록 (pre-order: 루트부터 순서대로)
        const currentOrder = this._buildCounter;
        this.buildSteps.push({
            order: currentOrder,
            point: medianPoint,
            axis: axis,
            depth: depth,
            bounds: { ...bounds },
            leftCount: leftPoints.length,
            rightCount: rightPoints.length
        });
        this._buildCounter++;

        // Recursively build children with updated bounds
        let leftBounds = { ...bounds };
        let rightBounds = { ...bounds };

        if (axis === 0) { // Splitting vertically
            leftBounds.maxX = medianPoint.x;
            rightBounds.minX = medianPoint.x;
        } else { // Splitting horizontally
            leftBounds.maxY = medianPoint.y;
            rightBounds.minY = medianPoint.y;
        }

        const leftNode = this.buildTree(leftPoints, depth + 1, leftBounds.minX, leftBounds.maxX, leftBounds.minY, leftBounds.maxY);
        const rightNode = this.buildTree(rightPoints, depth + 1, rightBounds.minX, rightBounds.maxX, rightBounds.minY, rightBounds.maxY);

        const node = new KDNode(medianPoint, axis, leftNode, rightNode, bounds);
        node.buildOrder = currentOrder;
        node.depth = depth;

        return node;
    }

    // Euclidean distance squared
    distSq(p1, p2) {
        return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
    }

    /**
     * Exact Nearest Neighbor Search
     */
    nearestNeighbor(query) {
        this.visitedNodes = [];
        let bestNode = null;
        let bestDist = Infinity;

        const search = (node) => {
            if (!node) return;

            this.visitedNodes.push(node);

            const d = this.distSq(query, node.point);
            if (d < bestDist) {
                bestDist = d;
                bestNode = node;
            }

            const axis = node.axis;
            const queryCoord = axis === 0 ? query.x : query.y;
            const nodeCoord = axis === 0 ? node.point.x : node.point.y;

            let first = null;
            let second = null;

            if (queryCoord < nodeCoord) {
                first = node.left;
                second = node.right;
            } else {
                first = node.right;
                second = node.left;
            }

            // Search the first half
            search(first);

            // Check if we need to search the second half
            // If the distance to the splitting plane is less than bestDist, there might be a closer point on the other side
            const distToPlaneSq = (queryCoord - nodeCoord) ** 2;
            if (distToPlaneSq < bestDist) {
                search(second);
            }
        };

        search(this.root);
        return { bestNode, visitedNodes: this.visitedNodes };
    }

    /**
     * Best-Bin-First (BBF) Approximate Nearest Neighbor Search
     */
    approxNearestNeighbor(query, tryAllowed) {
        this.visitedNodes = [];
        if (!this.root) return { bestNode: null, visitedNodes: [] };

        let bestNode = null;
        let bestDist = Infinity;
        let tries = 0;

        // Priority queue for branches not taken. 
        // Elements: { node, distToPlaneSq }
        // We use a simple array and sort it to simulate PQ (sufficient for our small dataset)
        let pq = [];

        // 1. Initial dive to the leaf
        let curr = this.root;
        while (curr) {
            this.visitedNodes.push(curr);
            const d = this.distSq(query, curr.point);
            if (d < bestDist) {
                bestDist = d;
                bestNode = curr;
            }

            const axis = curr.axis;
            const queryCoord = axis === 0 ? query.x : query.y;
            const nodeCoord = axis === 0 ? curr.point.x : curr.point.y;

            const distToPlaneSq = (queryCoord - nodeCoord) ** 2;

            if (queryCoord < nodeCoord) {
                if (curr.right) pq.push({ node: curr.right, distToPlaneSq });
                curr = curr.left;
            } else {
                if (curr.left) pq.push({ node: curr.left, distToPlaneSq });
                curr = curr.right;
            }
        }

        // 2. Backtracking using Priority Queue (Best-Bin-First)
        while (pq.length > 0 && tries < tryAllowed) {
            // Sort to get the minimum distance to plane
            pq.sort((a, b) => a.distToPlaneSq - b.distToPlaneSq);
            const branch = pq.shift();

            if (branch.distToPlaneSq >= bestDist) {
                // If the closest branch is further than our best distance, we can stop entirely
                break;
            }

            tries++; // Count this backtrack

            // Dive into this branch
            curr = branch.node;
            while (curr) {
                this.visitedNodes.push(curr);
                const d = this.distSq(query, curr.point);
                if (d < bestDist) {
                    bestDist = d;
                    bestNode = curr;
                }

                const axis = curr.axis;
                const queryCoord = axis === 0 ? query.x : query.y;
                const nodeCoord = axis === 0 ? curr.point.x : curr.point.y;

                const distToPlaneSq = (queryCoord - nodeCoord) ** 2;

                if (queryCoord < nodeCoord) {
                    if (curr.right) pq.push({ node: curr.right, distToPlaneSq });
                    curr = curr.left;
                } else {
                    if (curr.left) pq.push({ node: curr.left, distToPlaneSq });
                    curr = curr.right;
                }
            }
        }

        return { bestNode, visitedNodes: this.visitedNodes, triesUsed: tries };
    }
}
