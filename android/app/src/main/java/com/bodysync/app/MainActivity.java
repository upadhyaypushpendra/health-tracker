package com.bodysync.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthSyncPlugin.class);
    super.onCreate(savedInstanceState);

    // Handle widget intents
    Intent intent = getIntent();
    if (intent != null && "com.bodysync.app.LOG_WATER".equals(intent.getAction())) {
      int amount = intent.getIntExtra("amount", 250);
      intent.putExtra("logWaterAmount", amount);
    }
  }
}
