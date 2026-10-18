import type { Vehicle } from "./types";
import Image from "next/image";
export function VehicleVisualization({
  vehicle,
  compact = false,
}: {
  vehicle?: Vehicle;
  compact?: boolean;
}) {
  if(vehicle?.model.toUpperCase().startsWith('NWOW')&&!vehicle.image_url.startsWith('/api/vehicle-image'))return <figure className="vehicle-visual"><div className="vehicle-placeholder"><strong>NWOW</strong><p>{vehicle.name} · {vehicle.id}</p><p>Vehicle photo not provided</p></div></figure>;
  return (
    <figure className={"vehicle-visual " + (compact ? "compact" : "")}>
      <Image
        src={vehicle?.image_url || "/bemac-white.png"}
        width={1536}
        height={1024}
        sizes="(max-width: 700px) 92vw, 650px"
        loading="eager"
        unoptimized={vehicle?.image_url.startsWith('/api/')}
        alt={vehicle?.image_url.startsWith('/api/vehicle-image')?vehicle.model+' vehicle image':'White BEMAC 68VM Passenger, three-quarter product visualization'}
      />
      <figcaption>
        {vehicle?.image_url.startsWith("/api/vehicle-image")
          ? "Uploaded vehicle image"
          : "Reference-based visualization · White BEMAC 68VM"}
      </figcaption>
    </figure>
  );
}
