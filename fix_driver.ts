
import { AppDataSource } from "./src/config/db";
import { Problem } from "./src/entities/problem.entity";

async function fixDriverCode() {
    try {
        await AppDataSource.initialize();
        const problemRepo = AppDataSource.getRepository(Problem);
        const problem = await problemRepo.findOne({ where: { title: "3Sum Closest" } });

        if (problem) {
            console.log("Found problem:", problem.id);
            const driverCode = problem.driverCode as any;

            // Fix Python Driver: Remove the loop logic because Judge0 inputs are per-testcase (usually single case per file unless batch input format is used)
            // The input logs show:
            // "3\n0 0 0\n0\n2"
            // This corresponds to: n, nums, target, k
            // The current driver expects: t, then t test cases.

            driverCode.python = `if __name__ == "__main__":
    try:
        n_line = input()
        if not n_line: exit(0)
        n = int(n_line)
        nums = list(map(int, input().split()))
        target = int(input())
        k = int(input())
        print("true" if Solution().threeSumClosest(nums, target, k) else "false")
    except EOFError:
        pass`;

            // Fix C++ Driver if needed (it also has cin >> t)
            driverCode["c++"] = `int main() {
    int n, target, k;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; i++) {
            cin >> nums[i];
        }
        cin >> target >> k;
        Solution sol;
        cout << (sol.threeSumClosest(nums, target, k) ? "true" : "false") << endl;
    }
    return 0;
}`;

            // Fix Java Driver
            driverCode.java = `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int[] nums = new int[n];
            for (int i = 0; i < n; i++) {
                nums[i] = sc.nextInt();
            }
            int target = sc.nextInt();
            int k = sc.nextInt();
            Solution sol = new Solution();
            System.out.println(sol.threeSumClosest(nums, target, k) ? "true" : "false");
        }
        sc.close();
    }
}`;

            problem.driverCode = driverCode;
            await problemRepo.save(problem);
            console.log("Updated driver code successfully!");
        } else {
            console.log("Problem 3Sum Closest not found");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await AppDataSource.destroy();
    }
}

fixDriverCode();
