// src/components/GameCard.jsx
import CollectionToggle from "./CollectionToggle";
import { Card, CardBody, CardFooter } from "./ui/Card";
import GameImage from "./GameImage";

function averageRating(game) {
  if (!game?.ratingCount) return "–";
  return (game.ratingTotal / game.ratingCount).toFixed(1);
}

export default function GameCard({ game, inCollection, onOpen, onAdd, onRemove }) {
  return (
    <Card interactive noPadding onClick={onOpen}>
      <GameImage src={game.imageUrl} alt={game.title} />

      <CardBody>
        <h2 className="text-xl font-semibold text-white">{game.title}</h2>
        <p className="text-sm text-gray-300 mt-1 line-clamp-2">{game.description}</p>
        <p className="mt-2 text-yellow-400">⭐ {averageRating(game)}</p>
      </CardBody>

      <CardFooter className="flex flex-col gap-1">
        <button
          className="text-sm text-blue-400 hover:underline w-fit"
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