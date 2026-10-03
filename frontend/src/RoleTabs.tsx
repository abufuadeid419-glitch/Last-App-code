import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { GuidedTour } from "@/src/components/GuidedTour";
import { fonts, useTheme } from "@/src/theme";
import { IconName, Ionicons } from "@/src/ui";

export type TabDef = { name: string; title: string; icon: IconName; sf: string; desc?: string };

export function RoleTabs({ tabs, tourKey }: { tabs: TabDef[]; tourKey: string }) {
  const { colors } = useTheme();
  const tour = <GuidedTour tourKey={tourKey} tabs={tabs} />;
  if (usesNativeTabs) {
    return (
      <>
      <NativeTabs tintColor={colors.brandPrimary}>
        {tabs.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.title}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
      {tour}
      </>
    );
  }
  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
    {tour}
    </>
  );
}
