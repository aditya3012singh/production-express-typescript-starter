module.exports = {
    apps: [
        {
            name: "base-backend-ts-api",
            script: "./dist/index.js",
            instances: 1, // Scale across available CPU cores in production
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "500M",
            env: {
                NODE_ENV: "production",
                PORT: 4000
            },
            node_args: "--max-old-space-size=1024" // Prevent V8 garbage collection OOMs
        },
        {
            name: "base-backend-ts-worker",
            script: "./dist/core/queue/worker.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "500M",
            env: {
                NODE_ENV: "production"
            },
            node_args: "--max-old-space-size=1024"
        }
    ]
};
