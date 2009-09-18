package org.cagrid.hackathon.dcql;

import gov.nih.nci.cagrid.cqlquery.Attribute;
import gov.nih.nci.cagrid.cqlquery.Predicate;
import gov.nih.nci.cagrid.cqlresultset.CQLQueryResults;
import gov.nih.nci.cagrid.dcql.Association;
import gov.nih.nci.cagrid.dcql.DCQLQuery;
import gov.nih.nci.cagrid.dcqlresult.DCQLQueryResultsCollection;
import gov.nih.nci.cagrid.fqp.processor.FederatedQueryEngine;
import gov.nih.nci.cagrid.fqp.processor.exceptions.FederatedQueryProcessingException;


/** 
 *  DCQLQueryAPIExample
 *  An example of using the DCQL object API to build up 
 *  and execute federated queries using the local
 *  FQP Client API
 * 
 * @author David Ervin
 * 
 * @created Jun 24, 2008 8:39:44 AM
 * @version $Id: DCQLQueryAPIExample.java,v 1.3 2008-06-24 15:51:04 dervin Exp $ 
 */
public class DCQLQueryAPIExample {
    
    private FederatedQueryEngine engine = null;
    private boolean aggregate = false;
    
    public DCQLQueryAPIExample() {
        /*
         * The FederatedQueryEngine is the heart of Federated Query Processing
         * on the grid.  A Federated Query Service uses this same API internally.
         * It is designed to be usable both in a grid service, and as a stand-alone
         * client side API, as we are using it here.
         */
        this.engine = new FederatedQueryEngine();
        
        /*
         * This flag controls how query results are produced.  Setting it to
         * true causes the query results to be aggregated into a CQL query result instance
         */
        this.aggregate = false;
    }
    
    
    private DCQLQuery createQuery() {
        DCQLQuery query = new DCQLQuery();
        
        /*
         * A DCQL query can be built up using the object model
         * here.  To execute properly, the query must be well-formed
         * and conform to the exposed domain model of each data service
         * it touches in the course of the query
         */
        
        // --- ADD SAMPLE CODE HERE ---

        // --- ADD SAMPLE CODE HERE ---
        
        // uncomment the following line to use the aggregation query example
        // query = createAggregationExample();
        
        return query;
    }
    
    
    public void runQuery() {
        DCQLQuery query = createQuery();
        Object queryResults = null;
        /*
         * Here, we can choose to use the engine to execute the query and return
         * a DCQL query results collection, or to have the engine aggregate the
         * query results into a standard CQL query result. 
         */
        try {
            if (aggregate) {
                System.out.println("Executing aggregation query");
                queryResults = engine.executeAndAggregateResults(query);
            } else {
                System.out.println("Executing standard query");
                queryResults = engine.execute(query);
            }
        } catch (FederatedQueryProcessingException ex) {
            /*
             * If execution reaches this point, an error has occured processing
             * the federated query.  The exception should tell what the problem was.
             */
            ex.printStackTrace();
            System.exit(1);
        }
        
        System.out.println("RESULTS:");
        printResults(queryResults);
    }
    
    
    private void printResults(Object results) {
        if (results instanceof CQLQueryResults) {
            QueryResultPrinter.printCqlQueryResults((CQLQueryResults) results);
        } else if (results instanceof DCQLQueryResultsCollection) {
            QueryResultPrinter.printDcqlQueryResults((DCQLQueryResultsCollection) results);
        } else {
            System.err.println("UNABLE TO PRINT RESULTS OF TYPE " + results.getClass().getName());
        }
    }
    

    public static void main(String[] args) {
        DCQLQueryAPIExample example = new DCQLQueryAPIExample();
        example.runQuery();
    }
    
    
    /**
     * This query corresponds to the document resources/queries/sampleAggregation.xml
     * @return
     *      The DCQL Query
     */
    private DCQLQuery createAggregationExample() {
        // <ns1:DCQLQuery xmlns:ns1="http://caGrid.caBIG/1.0/gov.nih.nci.cagrid.dcql">
        DCQLQuery query = new DCQLQuery();
        
        //  <ns1:TargetObject name="model1.domain.Gene">
        gov.nih.nci.cagrid.dcql.Object targetObject = new gov.nih.nci.cagrid.dcql.Object();
        targetObject.setName("model1.domain.Gene");
        
        //   <ns1:Association name="model1.domain.Term" roleName="terms">
        Association termAssociation = new Association();
        termAssociation.setName("model1.domain.Term");
        termAssociation.setRoleName("terms");
        
        //    <ns1:Association name="model1.domain.Term" roleName="ancestors">
        Association ancestorTermAssociation = new Association();
        ancestorTermAssociation.setName("model1.domain.Term");
        ancestorTermAssociation.setRoleName("ancestors");
        
        //     <ns1:Attribute name="value" predicate="EQUAL_TO" value="root">
        Attribute valueAttribute = new Attribute();
        valueAttribute.setName("value");
        valueAttribute.setPredicate(Predicate.EQUAL_TO);
        valueAttribute.setValue("root");
        
        //     </ns1:Attribute>
        ancestorTermAssociation.setAttribute(valueAttribute);
        
        //    </ns1:Association>
        termAssociation.setAssociation(ancestorTermAssociation);
        
        //   </ns1:Association>
        targetObject.setAssociation(termAssociation);
        
        //  </ns1:targetObject>
        query.setTargetObject(targetObject);
        
        // <ns1:targetServiceURL>http://sbdev1000.semanticbits.com:13080/wsrf-model1/services/cagrid/Model1Svc</ns1:targetServiceURL>
        // <ns1:targetServiceURL>http://sbdev1000.semanticbits.com:13080/wsrf-model1-a/services/cagrid/Model1Svc</ns1:targetServiceURL>
        String[] targetServiceUrls = new String[] {
            "http://sbdev1000.semanticbits.com:13080/wsrf-model1/services/cagrid/Model1Svc",
            "http://sbdev1000.semanticbits.com:13080/wsrf-model1-a/services/cagrid/Model1Svc"
        };
        query.setTargetServiceURL(targetServiceUrls);
        
        // </ns1:DCQLQuery>
        return query;
    }
}
