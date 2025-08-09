import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  is_lifetime: boolean;
}

export function VipPlansManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price, duration_months, is_lifetime')
        .order('price');
      if (!error && data) {
        setPlans(data);
      }
      setLoading(false);
    };
    fetchPlans();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>VIP Plans</CardTitle>
        <CardDescription>Manage subscription plans</CardDescription>
      </CardHeader>
      <CardContent>
        {loading
          ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin' />
            </div>
          )
          : plans.length === 0
          ? <p className='text-sm text-muted-foreground'>No subscription plans found.</p>
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price (USDT)</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{plan.name}</TableCell>
                    <TableCell>{plan.price}</TableCell>
                    <TableCell>
                      {plan.is_lifetime ? 'Lifetime' : `${plan.duration_months} mo`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CardContent>
    </Card>
  );
}

export default VipPlansManager;
