# new update
## task
1. Here now there will be two section - 
    - model section : existing model section like "spatialGLue, SMART" and their score will be here. like dashboard it was.
    - ablation section: for a particular model we will do ablation here , Like for spatialGlue model, suppose we change a model like we implement diffrent encoder so and run it , and do ablatial what is the change happens . so in ablation section there will be our expremental model under a real model so we can see in the subsection of particular ablation model section, the real model score and also our new expreimental model options. and we can create a new model for ablation but there is no base model so that will be also a option to make. and in some model sub section we will do ablation. then when we find a good model then we can transfer it to. the Model section according its all result. 

2. Here we want to update cluster evaluation matrix, as there is internal and external evaluation matrix, so we wanted to keep, [seed, ARI, NMI, AMI, Silhouette, CHI, DBI ], so we are removing (Homogeneity,V-Measure) 

3. Now in model section for a particular dataset we can add a result with different cluster but, Now we want to add multiple result for a single cluster also, and for that, the random seed will be different.  so we want per dataset, for per cluster we want to add 10 different result from 10 different random seed. and the final score will come by, mean +- std;

4. in the current dashboard now there is some model section per dataset and their results. 
so , i want a section for analysis section. 
in the analysis section there will be some , graph and chart for better analysis. 
- Seed Score Distributions
- Seed-by-Seed Performance Curve
- Mean Performance & Standard Error
- Head-to-Head Comparison (Comparison Matrix (Model A vs B), Seed-by-Seed Difference Analysis) so in ablation study per model section it must wanted to keep to test different ablation model score. 


5. also keep a Markdown file and keep data, that is , what is change now?
6. also update SYSTEM_ARCHITECTURE.md file and DATA_FLOW.md file
