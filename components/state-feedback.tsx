type FeedbackVariant = "info" | "success" | "error";

const variantLabels: Record<FeedbackVariant, string> = {
  info: "Information",
  success: "Saved",
  error: "Error",
};

export function StateFeedback({
  variant,
  children,
}: {
  variant: FeedbackVariant;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`state-feedback state-feedback-${variant}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <span className="sr-only">{variantLabels[variant]}: </span>
      {children}
    </p>
  );
}
