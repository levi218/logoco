// Helper for combining webpack config objects
const { merge } = require('webpack-merge');
// const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = (config, context) => {
  return merge(config, {
    // overwrite values here
  //   module: {
  //     rules: [
  //         {
  //             test: /logger.html$/,
  //             type: "asset/resource"
  //         }
  //     ]
  // },
    plugins: [
        // new MonacoWebpackPlugin({
        //   // available options are documented at https://github.com/Microsoft/monaco-editor-webpack-plugin#options
        //   languages: ['json']
        // })
        
      ]
  });
};