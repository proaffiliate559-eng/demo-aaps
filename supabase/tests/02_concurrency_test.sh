#!/usr/bin/env bash
# Concurrency checks: run after 01_loyalty_rls_test.sql on the same database.
#   PSQL="psql -h localhost -p 54322 -U postgres -d postgres" ./02_concurrency_test.sh
set -euo pipefail
PSQL=${PSQL:-"psql -h /tmp -p 54329 -U postgres -d cr"}
Q="$PSQL -v ON_ERROR_STOP=1 -qtA"

KUNAL=00000000-0000-0000-0000-0000000000d2
REWARD=$($Q -c "select id from rewards where name = 'Free dessert' and tenant_id = (select id from tenants where slug = 'cafe-a')")
CUST=$($Q -c "select id from customers where auth_user_id = '$KUNAL'")

# Give Kunal exactly 300 points (enough for ONE dessert), recorded in the ledger.
$Q -c "select private.apply_txn(w.id, 'adjustment', 300 - w.points_balance, 0, 0, 'conc-setup-' || now(), null, null, null, 'test') from loyalty_wallets w where customer_id = '$CUST'" >/dev/null

redeem() {
  $PSQL -qtA 2>&1 <<SQL
set role authenticated;
select tests.login('$KUNAL', '919822222222');
begin;
select request_redemption('$REWARD')->>'code';
select pg_sleep(0.5);
commit;
SQL
}
redeem > /tmp/r1.out & redeem > /tmp/r2.out & wait
OK=$(grep -hcE '^[A-Z0-9]{8}$' /tmp/r1.out /tmp/r2.out | paste -sd+ | bc)
BAL=$($Q -c "select points_balance from loyalty_wallets where customer_id = '$CUST'")
echo "two simultaneous 300-pt redemptions with 300 pts: successes=$OK balance=$BAL"
[ "$OK" = "1" ] && [ "$BAL" = "0" ] || { echo "FAIL: double spend"; cat /tmp/r1.out /tmp/r2.out; exit 1; }
echo "ok - no double spend under concurrency"

# Same checkout key sent twice at the same moment → one purchase only.
CASHIER=00000000-0000-0000-0000-0000000000c1
TEN=$($Q -c "select id from tenants where slug = 'cafe-a'")
BR=$($Q -c "select branch_id from staff_members where user_id = '$CASHIER'")
buy() {
  $PSQL -qtA 2>&1 <<SQL
set role authenticated;
select tests.login('$CASHIER');
select record_purchase('$TEN', '$BR', '$CUST', 777, 'same-key-concurrent-1')->>'duplicate';
SQL
}
buy > /tmp/b1.out & buy > /tmp/b2.out & wait
N=$($Q -c "select count(*) from purchases where idempotency_key = 'same-key-concurrent-1'")
PTS=$($Q -c "select count(*) from loyalty_transactions lt join purchases p on p.id = lt.purchase_id where p.idempotency_key = 'same-key-concurrent-1' and lt.kind = 'earn_points'")
echo "same key twice at once: purchases=$N points_entries=$PTS (responses: $(tr '\n' ' ' < /tmp/b1.out) / $(tr '\n' ' ' < /tmp/b2.out))"
[ "$N" = "1" ] && [ "$PTS" = "1" ] || { echo "FAIL: duplicate purchase"; exit 1; }
echo "ok - one purchase per idempotency key under concurrency"

LEDGER_OK=$($Q -c "select not exists (select 1 from loyalty_wallets w where w.points_balance <> coalesce((select sum(points_delta) from loyalty_transactions t where t.wallet_id = w.id), 0))")
[ "$LEDGER_OK" = "t" ] || { echo "FAIL: ledger mismatch"; exit 1; }
echo "ok - wallets still match ledger"
echo "ALL CONCURRENCY TESTS PASSED"
