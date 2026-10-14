
import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  latitude: number;
  longitude: number;
  title: string;
};

export default function MapPreviewNative({
  latitude,
  longitude,
  title,
}: Props) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport"
          content="width=device-width, initial-scale=1.0">
        <style>
          html, body, iframe {
            margin: 0;
            width: 100%;
            height: 100%;
            border: 0;
          }
        </style>
      </head>
      <body>
        <iframe
          src="https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}"
          title="${title.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"
        ></iframe>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    overflow: "hidden",
    borderRadius: 12,
  },
  map: {
    flex: 1,
  },
});