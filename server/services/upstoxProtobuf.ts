/**
 * Upstox Market Data Feed V3 Protobuf Definition and Decoder
 * Official Upstox MarketDataFeed.proto schema for V3 feed
 */

import protobuf from 'protobufjs';

export const UPSTOX_V3_PROTO = `
syntax = "proto3";

package com.upstox.marketdatafeeder.rpc.proto;

message FeedResponse {
  enum Type {
    initial_feed = 0;
    live_feed = 1;
  }
  Type type = 1;
  map<string, Feed> feeds = 2;
  int64 currentTs = 3;
}

message Feed {
  oneof FeedUnion {
    LTPC ltpc = 1;
    FullFeed ff = 2;
  }
}

message LTPC {
  double ltp = 1;
  int64 ltt = 2;
  int64 ltq = 3;
  double cp = 4;
}

message FullFeed {
  oneof FullFeedUnion {
    MarketFullFeed marketFF = 1;
    IndexFullFeed indexFF = 2;
  }
}

message MarketFullFeed {
  MarketOHLC marketOHLC = 1;
  double ltpc = 2;
  int64 ltt = 3;
  int64 ltq = 4;
  double cp = 5;
  int64 vtt = 6;
  double atp = 7;
  double oi = 8;
  double change = 9;
  double changePercent = 10;
  MarketLevel marketLevel = 11;
  int64 eFeedDetails = 12;
}

message IndexFullFeed {
  MarketOHLC marketOHLC = 1;
  double ltpc = 2;
  int64 ltt = 3;
  double cp = 4;
  int64 vtt = 5;
  double change = 6;
  double changePercent = 7;
}

message MarketOHLC {
  repeated OHLC ohlc = 1;
}

message OHLC {
  string interval = 1;
  double open = 2;
  double high = 3;
  double low = 4;
  double close = 5;
  int64 volume = 6;
  int64 ts = 7;
}

message MarketLevel {
  repeated Quote bidAskQuote = 1;
}

message Quote {
  int32 bidQty = 1;
  double bidPrice = 2;
  int32 askQty = 3;
  double askPrice = 4;
}
`;

let rootCache: protobuf.Root | null = null;
let feedResponseTypeCache: protobuf.Type | null = null;

export function getUpstoxFeedResponseType(): protobuf.Type {
  if (!feedResponseTypeCache) {
    const parsed = protobuf.parse(UPSTOX_V3_PROTO);
    rootCache = parsed.root;
    feedResponseTypeCache = rootCache.lookupType('com.upstox.marketdatafeeder.rpc.proto.FeedResponse');
  }
  return feedResponseTypeCache;
}

export function decodeUpstoxV3Binary(buffer: Uint8Array): any {
  try {
    const type = getUpstoxFeedResponseType();
    const message = type.decode(buffer);
    return type.toObject(message, {
      longs: Number,
      enums: String,
      bytes: String,
      defaults: true,
      arrays: true,
      objects: true,
      oneofs: true
    });
  } catch (err) {
    console.error('[Upstox Protobuf] Failed to decode binary message:', err);
    return null;
  }
}
