import BotDashboard from "@/components/telegram/BotDashboard";
import Header from "@/components/layout/Header";
import { TelegramBotTest } from "@/components/TelegramBotTest";

const Index = () => {
  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <TelegramBotTest />
        <BotDashboard />
      </div>
    </>
  );
};

export default Index;
