import { StarsRating } from "@/components/shared";

interface StarRatingProps {
  rating: 4 | 5;
  className?: string;
}

export function StarRating({ rating, className }: StarRatingProps) {
  return (
    <div className={className}>
      <StarsRating rating={rating} label={`${rating} out of 5 stars`} />
    </div>
  );
}
