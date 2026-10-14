import { View } from "react-native";

type Props = {
  latitude: number;
  longitude: number;
  title: string;
};

export default function MapPreview({ latitude, longitude, title }: Props) {
  const delta = 0.01;

  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(",");

  const mapUrl =
    "https://www.openstreetmap.org/export/embed.html" +
    `?bbox=${encodeURIComponent(bbox)}` +
    "&layer=mapnik" +
    `&marker=${latitude},${longitude}`;

  return (
    <View style={{ height: 250, width: "100%" }}>
      <iframe
        title={title}
        src={mapUrl}
        width="100%"
        height="250"
        style={{
          border: 0,
          borderRadius: 10,
        }}
      />
    </View>
  );
}
