import React from "react";
import CollectionToggle from "./CollectionToggle";
import { Card, CardBody, CardFooter } from "./ui/Card";

function averageRating(game) {
  if (!game?.ratingCount) return "–";
  return (game.ratingTotal / game.ratingCount).toFixed(1);
}

export default function GameCard({
  game,
  inCollection,
  onOpen,
  onAdd,
  onRemove,
}) {
  return (
    <Card interactive noPadding onClick={onOpen}>
      {game.imageUrl && (
      <div
        className="w-full overflow-hidden rounded-xl bg-gray-100"
        style={{ height: "12rem" }}   // same as h-48, but guaranteed
      >
        <img
          src={game.imageUrl}
          alt={game.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    )}

      <CardBody>
        <h2 className="text-xl font-semibold">{game.title}</h2>

        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {game.description}
        </p>

        <p className="mt-2 text-yellow-700">⭐ {averageRating(game)}</p>
      </CardBody>

      <CardFooter className="flex flex-col gap-1">
      <button
        className="text-sm text-blue-700 hover:underline w-fit"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        Open Details
      </button>

        <CollectionToggle
          inCollection={inCollection}
          onAdd={onAdd}
          onRemove={onRemove}
          stopPropagation
        />
      </CardFooter>
    </Card>
  );
}