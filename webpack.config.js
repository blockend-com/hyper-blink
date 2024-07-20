// const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
// import { Buffer } from 'buffer';
// import HtmlWebpackPlugin from 'html-webpack-plugin';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
module.exports = {
  entry: {
    index: './src/index.ts',
    twitter: './src/ext/twitter.tsx',
    pageScript: './src/pageScript.js',
    inject: './src/inject.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer/'),
      ethers: require.resolve('ethers'),
    },
  },
  output: {
    filename: '[name].js',
    path: path.resolve('dist'),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      ethers: ['ethers'],
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve('dist'),
    },
    compress: true,
    port: 9000,
  },
};
