-- Seed plan channel links for VIP packages
insert into plan_channels (plan_id, channel_name, channel_type, invite_link)
select id, 'VIP Private Channel', 'channel', 'https://t.me/+_k_CP8gR20E2YTll'
from subscription_plans
where name ilike '%VIP%'
  and not exists (
    select 1 from plan_channels pc
    where pc.plan_id = subscription_plans.id
      and pc.channel_type = 'channel'
  );

insert into plan_channels (plan_id, channel_name, channel_type, invite_link)
select id, 'VIP Group', 'group', 'https://t.me/+-eTumm8BD88wMzY1'
from subscription_plans
where name ilike '%VIP%'
  and not exists (
    select 1 from plan_channels pc
    where pc.plan_id = subscription_plans.id
      and pc.channel_type = 'group'
  );
