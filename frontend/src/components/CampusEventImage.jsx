import React, { useState } from "react";

export default function CampusEventImage({ event }) {
  const [failed, setFailed] = useState(false);
  const image = event.image;
  const src = image?.src || (!event.external ? event.bannerUrl : "");
  if (!src || failed) return null;
  return (
    <figure className={`campus-media ${image?.type === "artwork" ? "campus-media-artwork" : ""}`}>
      <div className="campus-media-frame">
        <img
          src={src}
          srcSet={image?.thumbnail && image.thumbnailWidth < image.width ? `${image.thumbnail} ${image.thumbnailWidth}w, ${src} ${image.width}w` : undefined}
          sizes="(max-width: 700px) 90vw, (max-width: 1280px) 45vw, 540px"
          alt={image?.alt || `${event.title} organizer image`}
          width={image?.width || 1200}
          height={image?.height || 800}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
      <figcaption>
        <span>{image?.caption || "Organizer-supplied image"}</span>
        {image?.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">Image: {image.credit}</a>}
      </figcaption>
    </figure>
  );
}
