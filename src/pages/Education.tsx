import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, GraduationCap, Star, Target, Users } from "lucide-react";
import Header from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EducationCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
}

interface EducationPackage {
  id: string;
  category_id: string;
  name: string;
  description: string;
  detailed_description: string;
  price: number;
  currency: string;
  duration_weeks: number;
  is_lifetime: boolean;
  max_students: number | null;
  current_students: number;
  features: string[];
  requirements: string[];
  learning_outcomes: string[];
  instructor_name: string;
  instructor_bio: string;
  difficulty_level: string;
  is_featured: boolean;
  starts_at: string | null;
  enrollment_deadline: string | null;
}

type PaymentMethod = "bank_transfer" | "crypto";

interface BankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
}

type BankInstructions = { type: "bank_transfer"; banks: BankAccount[] };
type NoteInstructions = { type: "crypto"; note: string };
type CheckoutInstructions = BankInstructions | NoteInstructions;

const Education: React.FC = () => {
  const [categories, setCategories] = useState<EducationCategory[]>([]);
  const [packages, setPackages] = useState<EducationPackage[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [selectedPackage, setSelectedPackage] =
    useState<EducationPackage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("bank_transfer");
  const [telegramId, setTelegramId] = useState("");
  const [instructions, setInstructions] =
    useState<CheckoutInstructions | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const fetchEducationData = useCallback(async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("education_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (categoriesError) throw categoriesError;

      // Fetch packages
      const { data: packagesData, error: packagesError } = await supabase
        .from("education_packages")
        .select("*")
        .eq("is_active", true)
        .order("is_featured", { ascending: false });

      if (packagesError) throw packagesError;

      setCategories(categoriesData || []);
      // Normalize array fields to always be arrays
      setPackages(
        (packagesData || []).map((pkg) => ({
          ...pkg,
          features: pkg.features || [],
          requirements: pkg.requirements || [],
          learning_outcomes: pkg.learning_outcomes || [],
        })),
      );
    } catch (error) {
      console.error("Error fetching education data:", error);
      toast({
        title: "Error",
        description: "Failed to load education programs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEducationData();
  }, [fetchEducationData]);

  const filteredPackages = selectedCategory === "all"
    ? packages
    : packages.filter((pkg) => pkg.category_id === selectedCategory);

  const featuredPackages = packages.filter((pkg) => pkg.is_featured);

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-green-100 text-green-800";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "Advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  const openEnrollDialog = (pkg: EducationPackage) => {
    setSelectedPackage(pkg);
    setDialogOpen(true);
    setPaymentMethod("bank_transfer");
    setTelegramId("");
    setInstructions(null);
    setPaymentId(null);
  };

  const handleEnrollClick = async () => {
    if (!selectedPackage) return;
    setEnrolling(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        payment_id: string;
        instructions: CheckoutInstructions;
        error?: string;
      }>("checkout-init", {
        body: {
          telegram_id: telegramId,
          plan_id: selectedPackage.id,
          method: paymentMethod,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || "Checkout failed");
      }

      setPaymentId(data.payment_id);
      setInstructions(data.instructions);
    } catch (err) {
      console.error("Error initiating checkout:", err);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary">
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {instructions ? "Payment Instructions" : "Confirm Enrollment"}
            </DialogTitle>
            {!instructions && selectedPackage && (
              <DialogDescription>
                Confirm your enrollment for {selectedPackage.name}
              </DialogDescription>
            )}
          </DialogHeader>
          {instructions ? (
            <div className="space-y-4">
              {instructions.type === "bank_transfer" ? (
                <div className="space-y-4">
                  {instructions.banks.map((bank, idx) => (
                    <div
                      key={idx}
                      className="border rounded-md p-3 text-sm space-y-1"
                    >
                      <p className="font-medium">{bank.bank_name}</p>
                      <p>Account Name: {bank.account_name}</p>
                      <p>Account Number: {bank.account_number}</p>
                      <p>Currency: {bank.currency}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm">{instructions.note}</p>
              )}
              <DialogFooter>
                {paymentId && (
                  <Button asChild>
                    <a href={`/receipt-upload?payment_id=${paymentId}`}>
                      Upload Receipt
                    </a>
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="telegram_id">Telegram ID</Label>
                  <Input
                    id="telegram_id"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) =>
                      setPaymentMethod(v as PaymentMethod)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleEnrollClick}
                  disabled={!telegramId || enrolling}
                >
                  {enrolling ? "Loading..." : "Confirm"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-background to-background/80">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <div className="container mx-auto px-6 py-20">
            <div className="text-center">
              <h1 className="text-5xl font-bold mb-6">
                🎓 Education & Mentorship
              </h1>
              <p className="text-xl opacity-90 max-w-3xl mx-auto mb-8">
                Transform your trading journey with our comprehensive mentorship
                programs. Learn from industry experts and join a community of
                successful traders.
              </p>
              <div className="flex justify-center gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold">500+</div>
                  <div className="opacity-80">Students Trained</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">95%</div>
                  <div className="opacity-80">Success Rate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">10+</div>
                  <div className="opacity-80">Expert Mentors</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-12">
          {/* Featured Programs */}
          {featuredPackages.length > 0 && (
            <section className="mb-16">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4">
                  🌟 Featured Programs
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Our most popular and comprehensive mentorship programs
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {featuredPackages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className="border-2 border-primary/20 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start mb-4">
                        <Badge
                          className={getDifficultyColor(pkg.difficulty_level)}
                        >
                          {pkg.difficulty_level}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-primary text-primary-foreground"
                        >
                          Featured
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                      <CardDescription className="text-lg">
                        {pkg.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {pkg.duration_weeks} weeks
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {pkg.current_students}/{pkg.max_students || "∞"}
                            {" "}
                            students
                          </div>
                          <div className="flex items-center gap-1">
                            <GraduationCap className="h-4 w-4" />
                            {pkg.instructor_name}
                          </div>
                        </div>

                        <div className="text-3xl font-bold text-primary">
                          ${pkg.price}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            {pkg.currency}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            What you'll learn:
                          </h4>
                          <ul className="text-sm space-y-1">
                            {pkg.learning_outcomes.slice(0, 3).map((
                              outcome,
                              index,
                            ) => (
                              <li
                                key={index}
                                className="flex items-center gap-2"
                              >
                                <div className="w-1.5 h-1.5 bg-primary rounded-full">
                                </div>
                                {outcome}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button
                          onClick={() => openEnrollDialog(pkg)}
                          className="w-full"
                          size="lg"
                        >
                          Enroll Now - ${pkg.price}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* All Programs */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">📚 All Programs</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Browse our complete collection of mentorship programs
              </p>
            </div>

            <Tabs
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              className="mb-8"
            >
              <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                {categories.map((category) => (
                  <TabsTrigger key={category.id} value={category.id}>
                    {category.icon} {category.name.split(" ")[0]}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={selectedCategory}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredPackages.map((pkg) => (
                    <Card
                      key={pkg.id}
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <Badge
                            className={getDifficultyColor(pkg.difficulty_level)}
                          >
                            {pkg.difficulty_level}
                          </Badge>
                          {pkg.is_featured && (
                            <Badge
                              variant="secondary"
                              className="bg-primary text-primary-foreground"
                            >
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl">{pkg.name}</CardTitle>
                        <CardDescription>{pkg.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {pkg.duration_weeks} weeks
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {pkg.current_students}/{pkg.max_students || "∞"}
                            </div>
                          </div>

                          <div className="text-2xl font-bold text-primary">
                            ${pkg.price}
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">
                              Key Features:
                            </h4>
                            <ul className="text-sm space-y-1">
                              {pkg.features.slice(0, 2).map((
                                feature,
                                index,
                              ) => (
                                <li
                                  key={index}
                                  className="flex items-center gap-2"
                                >
                                  <div className="w-1.5 h-1.5 bg-primary rounded-full">
                                  </div>
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <Button
                            onClick={() => openEnrollDialog(pkg)}
                            className="w-full"
                          >
                            Learn More
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </section>

          {/* Call to Action */}
          <section className="mt-20 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              🚀 Ready to Start Your Journey?
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join hundreds of successful traders who transformed their careers
              through our mentorship programs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                onClick={() =>
                  toast({
                    title: "Contact Support",
                    description:
                      "Message @DynamicCapital_Support on Telegram to get started!",
                  })}
              >
                Contact Support
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              >
                View All Programs
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default Education;
