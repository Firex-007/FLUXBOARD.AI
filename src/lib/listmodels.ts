export async function getTopFreeModels(apiKey: string): Promise<string[]> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            console.warn("API Key unauthorized or quota exceeded for listModels.");
            return ['gemini-1.5-pro', 'gemini-1.5-flash']; // Safe defaults
        }
        
        const data = await response.json();
        
        // Filter out models that cannot generate text content
        const generateModels = data.models.filter((m: any) => 
            m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent') &&
            !m.name.includes('vision') && !m.name.includes('embedding')
        );

        // Sort logic: '3.1' > '3' > '2.5' > '1.5', and 'pro' > 'flash'
        generateModels.sort((a: any, b: any) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            
            // Version priority
            const versions = ['3.1', '3.0', '3', '2.5', '1.5'];
            for (const v of versions) {
                const aHas = aName.includes(v);
                const bHas = bName.includes(v);
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
            }

            // Tier priority within same version
            if (aName.includes('pro') && !bName.includes('pro')) return -1;
            if (!aName.includes('pro') && bName.includes('pro')) return 1;
            
            return 0;
        });

        // Strip the 'models/' prefix and return top 3
        const topModels = generateModels.slice(0, 3).map((m: any) => m.name.replace('models/', ''));
        console.log("🚀 Modern LLMs detected for Fluxboard:", topModels);
        
        return topModels.length > 0 ? topModels : ['gemini-3-flash'];

    } catch(err) {
        console.warn("Network error fetching models:", err);
        return ['gemini-3-flash', 'gemini-2.5-flash'];
    }
}
