# @TEST-EXEC: zeek -b %INPUT >out
# @TEST-EXEC: TEST_DIFF_CANONIFIER=$SCRIPTS/diff-remove-abspath btest-diff .stderr
# @TEST-EXEC: btest-diff out

const my_table: table[subnet] of subnet &redef;

redef my_table += { [3.0.0.0/8] = 1.0.0.0/8 };
redef my_table += { [3.0.0.0/8] = 2.0.0.0/8 };

event zeek_init()
	{
	print my_table;
	print my_table[3.0.0.0/8];
	}
