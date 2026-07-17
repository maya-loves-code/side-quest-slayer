#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataBridge, NSObject)

RCT_EXTERN_METHOD(sync:(NSArray *)entries
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
