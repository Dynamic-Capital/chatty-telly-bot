import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const PaymentStatus = () => {
  const [params] = useSearchParams();
  const status = params.get("status");
  const isSuccess = status === "success";

  return (
    <div className="flex justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Alert variant={isSuccess ? "default" : "destructive"}>
          {isSuccess ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {isSuccess ? "Payment Successful" : "Payment Failed"}
          </AlertTitle>
          <AlertDescription>
            {isSuccess
              ? "Thank you for your purchase! Your plan is now active."
              : "Something went wrong with your payment. Please try again."}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link to="/">Return Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default PaymentStatus;

