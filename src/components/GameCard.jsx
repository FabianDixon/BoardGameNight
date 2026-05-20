// src/components/GameCard.jsx
import CollectionToggle from "./CollectionToggle";
import { Card, CardBody, CardFooter } from "./ui/Card";
import GameImage from "./GameImage";
import { MIN_RATINGS_TO_DISPLAY } from "../constants/ratings";

function averageRating(game) {
  if (!game?.ratingCount) return "–";
  return (game.ratingTotal / game.ratingCount).toFixed(1);
}

function hasMinimumRatings(game) {
  return Number(game?.ratingCount || 0) >= MIN_RATINGS_TO_DISPLAY;
}

function aggregateRatingLabel(game) {
  return hasMinimumRatings(game) ? averageRating(game) : "–";
}

export default function GameCard({ game, inCollection, onOpen, onAdd, onRemove, view = "library" }) {
  return (
    <Card interactive noPadding onClick={onOpen} className="group h-full">
      <GameImage
        src={game.imageUrl}
        alt={game.title}
        className={view === "collection" ? "bg-emerald-950/20" : ""}
      />

      <CardBody>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold leading-tight text-white line-clamp-2">{game.title}</h2>
          <span className="ui-chip-yellow shrink-0">⭐ {aggregateRatingLabel(game)}</span>
        </div>

        <p className="text-sm text-neutral-300 line-clamp-2 min-h-[2.5rem]">
          {game.description || "No description available."}
        </p>

        {view === "collection" ? (
          <div className="ui-chip-green w-fit">Your shelf</div>
        ) : inCollection ? (
          <div className="ui-chip-green w-fit">In your collection</div>
        ) : null}
      </CardBody>

      <CardFooter className="mt-auto border-t border-neutral-700/80 flex items-center justify-between gap-2 pt-3">
        <button
          className="ui-btn-ghost px-3 py-1.5 text-xs"
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
          compact
        />
      </CardFooter>
    </Card>
  );
}