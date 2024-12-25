const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    service_worker: "./src/core/service_worker.js",
    break: "./src/pages/break/break.js",
    complete: "./src/pages/complete/complete.js",
    long_break: "./src/pages/long-break/long-break.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "src/pages/**/**", to: "[name][ext]" },
        { from: "icons", to: "icons" },
      ],
    }),
  ],
};
