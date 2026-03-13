const fetchData = async () => {
    const endpoints = [
        "http://localhost:3000/api/employees",
        "http://localhost:3000/api/locations"
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            console.log(`${url}: ${res.status} ${res.statusText}`);
        } catch (err) {
            console.error(`${url}: Error - ${err.message}`);
        }
    }

    // Test Login
    try {
        const res = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email: "aman.meena@geeksofgurukul.com", 
                password: "Aman@4488",
                role: "PROFESSOR"
            })
        });
        const data = await res.json();
        console.log(`Login API: ${res.status} Success: ${data.success}`);
        if (!data.success) console.log("Error:", data.error);
    } catch (err) {
        console.error(`Login API: Error - ${err.message}`);
    }
};

fetchData();
